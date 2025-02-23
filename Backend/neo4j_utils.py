import os
from neo4j import GraphDatabase
import logging

logger = logging.getLogger(__name__)


def get_neo4j_driver():
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    return driver


neo4j_driver = get_neo4j_driver()


def get_all_nodes_from_neo4j():
    logger.info("Getting all nodes from Neo4j.")

    with neo4j_driver.session() as session:
        query = """
        MATCH (n) 
        RETURN n.name as name, n.context as context
        """
        result = session.run(query)
        return result.data()


def get_subgraph_from_neo4j(nodes):
    logger.info("Getting subgraph from Neo4j.")
    with neo4j_driver.session() as session:
        query = """
        MATCH (n:Node)-[r:CONNECTED]->(m:Node)
        WHERE n.name in $nodes OR m.name in $nodes
        RETURN n.name as from, m.name as to, r.name as name, r.context as relationship_context, n.context as from_context, m.context as to_context, r.imageSources as relationship_imageSources, n.imageSources as from_imageSources, m.imageSources as to_imageSources
        """
        result = session.run(query, nodes=nodes)
        subgraph = {
            "nodes": [],
            "relationships": [],
        }
        nodes_set = set()
        for record in result:
            relationship = {
                "name": record["name"],
                "from": record["from"],
                "to": record["to"],
                "context": record["relationship_context"],
                "imageSources": record["relationship_imageSources"],
            }
            subgraph["relationships"].append(relationship)

            from_node = {
                "name": record["from"],
                "context": record["from_context"],
                "imageSources": record["from_imageSources"],
            }
            if from_node["name"] not in nodes_set:
                subgraph["nodes"].append(from_node)
                nodes_set.add(from_node["name"])

            to_node = {
                "name": record["to"],
                "context": record["to_context"],
                "imageSources": record["to_imageSources"],
            }
            if to_node["name"] not in nodes_set:
                subgraph["nodes"].append(to_node)
                nodes_set.add(to_node["name"])

        return subgraph


def get_fullgraph_from_neo4j():
    logger.info("Getting full graph from Neo4j.")
    graph = {
        "nodes": [],
        "relationships": [],
    }
    with neo4j_driver.session() as session:
        queryNodes = """
        MATCH (n:Node)
        RETURN n.name as name, n.context as context, n.imageSources as imageSources
        """
        resultNodes = session.run(queryNodes)
        graph["nodes"] = resultNodes.data()

        queryRelationships = """
        MATCH (n:Node)-[r:CONNECTED]->(m:Node)
        RETURN n.name as from, m.name as to, r.name as name, r.context as context, r.imageSources as imageSources
        """
        resultRelationships = session.run(queryRelationships)
        graph["relationships"] = resultRelationships.data()

    return graph


def save_to_neo4j(graph):
    logger.info("Saving connections to Neo4j.")
    with neo4j_driver.session() as session:
        for node in graph["nodes"]:
            name = node["name"]
            context = node["context"]
            imageSources = node["imageSources"]
            query = """
            MERGE (n:Node {name: $name})
            ON CREATE SET n.context = $context, n.imageSources = $imageSources
            ON MATCH SET n.context = apoc.coll.toSet(n.context + $context), n.imageSources = apoc.coll.toSet(n.imageSources + $imageSources)
            """
            session.run(query, name=name, context=context, imageSources=imageSources)

        for relationship in graph["relationships"]:
            name = relationship["name"]
            from_node = relationship["from"]
            to_node = relationship["to"]
            context = relationship["context"]
            imageSources = relationship["imageSources"]
            query = """
            MATCH (from:Node {name: $from_node})
            MATCH (to:Node {name: $to_node})
            MERGE (from)-[r:CONNECTED {name: $name}]->(to)
            ON CREATE SET r.context = $context, r.imageSources = $imageSources
            ON MATCH SET r.context = apoc.coll.toSet(r.context + $context), r.imageSources = apoc.coll.toSet(r.imageSources + $imageSources)
            """
            session.run(
                query,
                name=name,
                from_node=from_node,
                to_node=to_node,
                context=context,
                imageSources=imageSources,
            )


def delete_all_from_neo4j():
    logger.info("Deleting all nodes and relationships from Neo4j.")
    with neo4j_driver.session() as session:
        query = """
        MATCH (n)
        DETACH DELETE n
        """
        session.run(query)


def process_edit_graph(editedNodes, deletedEdges, addedEdges):

    # Loop over deleted edges
    for edge in deletedEdges:
        fromNode = edge["from"]
        toNode = edge["to"]
        label = edge["label"]
        query = """
        MATCH (from:Node {name: $fromNode})-[r:CONNECTED {name: $label}]->(to:Node {name: $toNode})
        DELETE r
        """
        with neo4j_driver.session() as session:
            session.run(query, fromNode=fromNode, toNode=toNode, label=label)

    # Loop over added edges
    for edge in addedEdges:
        fromNode = edge["from"]
        toNode = edge["to"]
        label = edge["label"]
        query = """
        MATCH (from:Node {name: $fromNode})
        MATCH (to:Node {name: $toNode})
        MERGE (from)-[r:CONNECTED {name: $label}]->(to)
        ON CREATE SET r.context = [], r.imageSources = ["User Edited"]
        """
        with neo4j_driver.session() as session:
            session.run(query, fromNode=fromNode, toNode=toNode, label=label)

    # Loop over edited nodes
    for node in editedNodes:
        oldName = node["oldName"]
        newName = node["newName"]
        # If old name is empty, then create a new node
        # if new name is empty, then delete the node
        # Otherwise, update the node
        if oldName == "":
            # Create a new node
            query = """
            MERGE (n:Node {name: $newName})
            ON CREATE SET n.context = [], n.imageSources = ["User Edited"]
            """
            with neo4j_driver.session() as session:
                session.run(query, newName=newName)
        elif newName == "":
            # Delete the node
            query = """
            MATCH (n:Node {name: $oldName})
            DETACH DELETE n
            """
            with neo4j_driver.session() as session:
                session.run(query, oldName=oldName)
        else:
            # Update the node
            query = """
            MATCH (n:Node {name: $oldName})
            SET n.name = $newName
            """
            with neo4j_driver.session() as session:
                session.run(query, oldName=oldName, newName=newName)

    return get_fullgraph_from_neo4j()
